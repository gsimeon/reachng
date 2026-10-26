import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReachNG — Nigeria Digital Postcode & Location Intelligence",
  description: "Enterprise workspace for exploring, validating, and managing Nigerian digital postcodes (NDAPS) and business location infrastructure.",
  keywords: ["Nigeria Postcode", "NDAPS", "Nigerian Digital Postcode", "Lagos Postcode", "Abuja Postcode", "NIPOST", "Location Intelligence Nigeria"],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-[#cde8d6] selection:text-[#0e3b29]">
        {children}
      </body>
    </html>
  );
}
