// "use client";

// import { useState } from "react";
// import { Button } from "@/components/ui/button";
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card";
// import { Alert, AlertDescription } from "@/components/ui/alert";
// import { Upload, Database, CheckCircle, XCircle, Loader2 } from "lucide-react";

// export default function MigratePage() {
//   const [file, setFile] = useState<File | null>(null);
//   const [loading, setLoading] = useState(false);
//   const [result, setResult] = useState<{
//     success: boolean;
//     message: string;
//     migratedCount?: number;
//   } | null>(null);

//   const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
//     const selectedFile = event.target.files?.[0];
//     if (selectedFile) {
//       setFile(selectedFile);
//       setResult(null);
//     }
//   };

//   const handleMigrate = async () => {
//     if (!file) {
//       setResult({
//         success: false,
//         message: "Please select a file first",
//       });
//       return;
//     }

//     setLoading(true);
//     setResult(null);

//     try {
//       const formData = new FormData();
//       formData.append("file", file);

//       const response = await fetch("/api/admin/migrate", {
//         method: "POST",
//         body: formData,
//       });

//       const data = await response.json();

//       if (response.ok) {
//         setResult({
//           success: true,
//           message: data.message || "Migration completed successfully",
//           migratedCount: data.migratedCount,
//         });
//         setFile(null);
//       } else {
//         setResult({
//           success: false,
//           message: data.error || "Migration failed",
//         });
//       }
//     } catch (error) {
//       setResult({
//         success: false,
//         message:
//           error instanceof Error
//             ? error.message
//             : "An error occurred during migration",
//       });
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="container mx-auto py-10 max-w-2xl">
//       <Card>
//         <CardHeader>
//           <CardTitle className="flex items-center gap-2">
//             <Database className="h-6 w-6" />
//             Database Migration
//           </CardTitle>
//           <CardDescription>
//             Upload a SQL file containing user data to migrate to the database.
//             All user information will be preserved.
//           </CardDescription>
//         </CardHeader>
//         <CardContent className="space-y-6">
//           <div className="space-y-4">
//             <div className="flex flex-col gap-4">
//               <label
//                 htmlFor="file-upload"
//                 className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
//               >
//                 <div className="flex flex-col items-center justify-center pt-5 pb-6">
//                   <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
//                   <p className="text-sm text-muted-foreground">
//                     {file ? (
//                       <span className="font-medium">{file.name}</span>
//                     ) : (
//                       <>
//                         <span className="font-semibold">Click to upload</span>{" "}
//                         or drag and drop
//                       </>
//                     )}
//                   </p>
//                   <p className="text-xs text-muted-foreground mt-1">
//                     SQL file (users.sql)
//                   </p>
//                 </div>
//                 <input
//                   id="file-upload"
//                   type="file"
//                   className="hidden"
//                   accept=".sql"
//                   onChange={handleFileSelect}
//                   disabled={loading}
//                 />
//               </label>

//               <Button
//                 onClick={handleMigrate}
//                 disabled={!file || loading}
//                 className="w-full"
//                 size="lg"
//               >
//                 {loading ? (
//                   <>
//                     <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                     Migrating...
//                   </>
//                 ) : (
//                   <>
//                     <Database className="mr-2 h-4 w-4" />
//                     Migrate Data
//                   </>
//                 )}
//               </Button>
//             </div>
//           </div>

//           {result && (
//             <Alert variant={result.success ? "default" : "destructive"}>
//               <div className="flex items-start gap-2">
//                 {result.success ? (
//                   <CheckCircle className="h-5 w-5 text-green-600" />
//                 ) : (
//                   <XCircle className="h-5 w-5" />
//                 )}
//                 <div className="flex-1">
//                   <AlertDescription>
//                     {result.message}
//                     {result.migratedCount !== undefined && (
//                       <span className="block mt-1 font-medium">
//                         Successfully migrated {result.migratedCount} user(s)
//                       </span>
//                     )}
//                   </AlertDescription>
//                 </div>
//               </div>
//             </Alert>
//           )}
//         </CardContent>
//       </Card>
//     </div>
//   );
// }

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Database, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function MigratePage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalMigrated, setTotalMigrated] = useState(0);
  const [totalSkipped, setTotalSkipped] = useState(0);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setProgress(0);
      setTotalMigrated(0);
      setTotalSkipped(0);
      setCurrentBatch(0);
    }
  };

  const processBatch = async (
    file: File,
    offset: number,
    batchNumber: number
  ): Promise<any> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("offset", offset.toString());
    formData.append("batch", batchNumber.toString());

    const response = await fetch("/api/admin/migrate", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Batch ${batchNumber} failed`);
    }

    return await response.json();
  };

  const handleMigrate = async () => {
    if (!file) {
      setResult({
        success: false,
        message: "Please select a file first",
      });
      return;
    }

    setLoading(true);
    setResult(null);
    setProgress(0);
    setTotalMigrated(0);
    setTotalSkipped(0);
    setCurrentBatch(0);

    try {
      let offset = 0;
      let batchNumber = 0;
      let hasMore = true;
      let totalMig = 0;
      let totalSkip = 0;

      while (hasMore) {
        setCurrentBatch(batchNumber + 1);

        const data = await processBatch(file, offset, batchNumber);

        totalMig += data.migratedCount || 0;
        totalSkip += data.skippedCount || 0;

        setTotalMigrated(totalMig);
        setTotalSkipped(totalSkip);
        setProgress(parseFloat(data.progress) || 0);

        hasMore = data.hasMore;
        offset = data.nextOffset;
        batchNumber = data.batchNumber;

        // Small delay to prevent overwhelming the server
        if (hasMore) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      setResult({
        success: true,
        message: `Migration completed successfully! ${totalMig} users migrated, ${totalSkip} skipped.`,
      });
      setFile(null);
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Migration failed",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-6 w-6" />
            Database Migration
          </CardTitle>
          <CardDescription>
            Upload a SQL file containing user data. The system will process
            users in batches of 1,000 to ensure reliable migration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex flex-col gap-4">
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {file ? (
                      <span className="font-medium">{file.name}</span>
                    ) : (
                      <>
                        <span className="font-semibold">Click to upload</span>{" "}
                        or drag and drop
                      </>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    SQL file (users.sql)
                  </p>
                </div>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept=".sql"
                  onChange={handleFileSelect}
                  disabled={loading}
                />
              </label>

              <Button
                onClick={handleMigrate}
                disabled={!file || loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing Batch {currentBatch}...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    Start Migration
                  </>
                )}
              </Button>
            </div>
          </div>

          {loading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress: {progress}%</span>
                <span>Batch {currentBatch}</span>
              </div>
              <Progress value={progress} className="w-full" />
              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium text-green-600">
                    {totalMigrated}
                  </span>{" "}
                  migrated
                </div>
                <div>
                  <span className="font-medium text-yellow-600">
                    {totalSkipped}
                  </span>{" "}
                  skipped
                </div>
              </div>
            </div>
          )}

          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              <div className="flex items-start gap-2">
                {result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5" />
                )}
                <div className="flex-1">
                  <AlertDescription>{result.message}</AlertDescription>
                </div>
              </div>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
