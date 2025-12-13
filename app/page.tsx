import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";

const Home = () => {
  return (
    <div className="container min-h-screen flex flex-col justify-center items-center p-4">
      <header className="header">
        <h1>This is the home Page</h1>
        <nav>
          <Link href="/about">About Us</Link>
        </nav>
      </header>
      <main className="main-content">
        <Button></Button>
        <p>
          Welcome to our website! Explore our content and learn more about us.
        </p>
      </main>
      <footer className="footer bottom-0 w-full text-center p-4">
        <p>&copy; 2024 My Website</p>
      </footer>
    </div>
  );
};
export default Home;
