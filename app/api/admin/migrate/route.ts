import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

// Parse SQL INSERT statements from the uploaded file
function parseInsertStatements(sqlContent: string) {
  const users: any[] = [];

  // Match INSERT INTO statements with VALUES
  const insertRegex =
    /INSERT INTO `users`[^(]*\([^)]+\)\s+VALUES\s*([\s\S]+?);/g;
  const matches = Array.from(sqlContent.matchAll(insertRegex));

  for (const match of matches) {
    const valuesSection = match[1];

    // Split by ),( to get individual user records
    const userRecords = valuesSection.split(/\),\s*\(/);

    for (let record of userRecords) {
      // Clean up the record
      record = record.replace(/^\(/, "").replace(/\)$/, "");

      // Parse the values - handle quoted strings and NULLs
      const values: string[] = [];
      let currentValue = "";
      let inQuote = false;
      let escapeNext = false;

      for (let i = 0; i < record.length; i++) {
        const char = record[i];

        if (escapeNext) {
          currentValue += char;
          escapeNext = false;
          continue;
        }

        if (char === "\\") {
          escapeNext = true;
          continue;
        }

        if (char === "'" && !escapeNext) {
          if (inQuote) {
            // Check if it's a doubled quote (escaped)
            if (record[i + 1] === "'") {
              currentValue += "'";
              i++;
            } else {
              inQuote = false;
            }
          } else {
            inQuote = true;
          }
          continue;
        }

        if (char === "," && !inQuote) {
          values.push(currentValue.trim());
          currentValue = "";
          continue;
        }

        currentValue += char;
      }

      // Add the last value
      if (currentValue) {
        values.push(currentValue.trim());
      }

      if (values.length >= 19) {
        // Map SQL fields to our schema
        // SQL: id, user_name, phone, email, date, time, balance, password, token,
        //      bank_account, account_number, bank_name, account_number_22, json,
        //      currency, del, promo_code, country, bank_token

        const email = values[3] || "";
        const phone = values[2] || "";
        const userName = values[1] || "";

        // Skip if essential fields are missing
        if (!email || !userName) continue;

        users.push({
          email,
          phone: phone || null,
          userName,
          name: userName,
          password: values[7] || "", // Already hashed in the SQL
          balance: parseFloat(values[6] || "0"),
          currency: values[14] || "NGN",
          bankAccount: values[9] === "YES" ? "YES" : null,
          accountNumber: values[10] || null,
          bankName: values[11] || null,
          promoCode: values[16] || null,
          country: values[17] || null,
          emailVerified: false,
          phoneVerified: false,
          status: "ACTIVE",
          role: "USER",
        });
      }
    }
  }

  return users;
}

export async function POST(request: NextRequest) {
  try {
    // Get the uploaded file
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Read the file content
    const content = await file.text();

    // Parse the SQL file
    const users = parseInsertStatements(content);

    if (users.length === 0) {
      return NextResponse.json(
        { error: "No valid user data found in the file" },
        { status: 400 }
      );
    }

    // Migrate users to database
    let migratedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const userData of users) {
      try {
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: userData.email },
        });

        if (existingUser) {
          skippedCount++;
          continue;
        }

        // Generate a unique referral code
        const referralCode = `REF${Date.now()}${Math.random()
          .toString(36)
          .substring(2, 7)
          .toUpperCase()}`;

        // Create the user
        await prisma.user.create({
          data: {
            ...userData,
            referralCode,
          },
        });

        migratedCount++;
      } catch (error) {
        console.error(`Error migrating user ${userData.email}:`, error);
        errors.push(
          `Failed to migrate ${userData.email}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Migration completed. ${migratedCount} users migrated, ${skippedCount} skipped (already exist).`,
      migratedCount,
      skippedCount,
      totalProcessed: users.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      {
        error: "Migration failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
