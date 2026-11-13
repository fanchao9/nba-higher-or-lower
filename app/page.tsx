import Game from "@/app/components/Game";
import { loadPlayers } from "@/app/lib/load-players";

export default function Home() {
  return <Game players={loadPlayers()} />;
}
