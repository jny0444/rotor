import Header from "@/components/Header";
import UserPane from "@/components/UserPane";

export default function Profile() {
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
        <UserPane />
      </div>
    </div>
  );
}
