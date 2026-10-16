import { WelcomeGate } from "@/components/gateway/WelcomeGate";
import { Hub } from "@/components/home/Hub";

export default function Home() {
  return (
    <WelcomeGate>
      <Hub />
    </WelcomeGate>
  );
}
