import App from "@/components/App";
import Hero from "@/components/Hero";
import { About, Contact, Events, Fleet } from "@/components/Sections";

export default function Home() {
  return (
    <App>
      <main>
        <Hero />
        <Fleet />
        <Events />
        <About />
      </main>
      <Contact />
    </App>
  );
}
