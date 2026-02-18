import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Swap from "@/components/Swap";

export default function Home() {
  return (
    <div className="relative min-h-screen">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed top-0 left-0 w-full h-full object-cover -z-10"
      >
        <source src="/bg.webm" type="video/webm" />
      </video>
      <div className="relative z-10 flex flex-col min-h-screen">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6">
          <div className="flex flex-row items-center text-6xl sm:text-6xl md:text-8xl bricolage-grotesque-font">
            <p>Go Stealth</p>
          </div>
          <div className="flex flex-row items-center text-6xl sm:text-6xl md:text-8xl bricolage-grotesque-font">
            <p>on Stellar</p>
          </div>
          <Swap />
        </div>
        <Footer />
      </div>
    </div>
  );
}

