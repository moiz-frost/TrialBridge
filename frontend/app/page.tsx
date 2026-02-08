import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { RegionsSection } from "@/components/landing/regions-section";
import { Footer } from "@/components/footer";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Find relevant clinical trials faster with AI-assisted matching for coordinators and patients.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    title: "TrialBridge | Clinical Trial Matching",
    description:
      "Find relevant clinical trials faster with AI-assisted matching for coordinators and patients.",
  },
};

export default function LandingPage() {
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "TrialBridge",
    url: siteUrl,
    description:
      "AI-assisted clinical trial matching for patients and hospital coordinators.",
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/coordinator/trials?search={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <Navbar />
      <main>
        <HeroSection />
        <HowItWorksSection />
        <FeaturesSection />
        <RegionsSection />
      </main>
      <Footer />
    </div>
  );
}
