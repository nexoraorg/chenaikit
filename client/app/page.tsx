import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Hero from "@/components/sections/hero";
import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import {
  Wallet,
  Trophy,
  Zap,
  Shield,
  Users,
  TrendingUp,
  ArrowRight,
  Star,
  Code,
  TreePine,
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
   
   
  <Header />

      <main className="flex-grow">
   
     <Hero/>


        <section className="py-20">
          <div className="container mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">🚀 Level Up Your Skills</h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                Learn real coding. Get rewarded. Prove it on-chain.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {/* Repeat for each card */}
              {[
                {
                  title: "Soulbound Character NFT",
                  desc: "Your identity in the Skillsig universe. Non-transferable proof of your learning journey.",
                  icon: <Shield className="w-6 h-6 text-purple-400" />,
                },
                {
                  title: "Coding & Logic Quests",
                  desc: "Real-world challenges from frontend to Solidity. All auto-validated.",
                  icon: <Code className="w-6 h-6 text-blue-400" />,
                },
                {
                  title: "Skill Badge NFTs",
                  desc: "Earn tradeable NFTs showing specific skills and achievements.",
                  icon: <Trophy className="w-6 h-6 text-yellow-400" />,
                },
                {
                  title: "Visual Skill Tree",
                  desc: "Grow and unlock paths in your personalized skill tree.",
                  icon: <TreePine className="w-6 h-6 text-green-400" />,
                },
                {
                  title: "Onchain Verification",
                  desc: "Your achievements are permanently recorded on-chain for anyone to verify.",
                  icon: <Shield className="w-6 h-6 text-red-400" />,
                },
                {
                  title: "Dynamic Progression",
                  desc: "Your NFT evolves with your skills — changing appearance, stats, and more.",
                  icon: <TrendingUp className="w-6 h-6 text-indigo-400" />,
                },
              ].map((card, idx) => (
                <Card
                  key={idx}
                  className="bg-gray-800/50 border border-gray-700 p-6 hover:bg-gray-800/70 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-white/5">{card.icon}</div>
                    <h3 className="text-lg font-semibold">{card.title}</h3>
                  </div>
                  <p className="text-gray-300">{card.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-gradient-to-r from-green-500/10 to-blue-500/10">
          <div className="container mx-auto px-6 text-center">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">Ready to Begin Your Quest?</h2>
              <p className="text-xl text-gray-300 mb-8 leading-relaxed">
                Join thousands of devs building their on-chain rep through gamified learning.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/game">
                  <Button size="lg" className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 text-lg">
                    <Star className="w-5 h-5 mr-2" />
                    Start Your Journey
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

   <Footer />
    </div>
  );
}
