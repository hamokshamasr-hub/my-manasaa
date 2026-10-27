import Hero from '../components/Hero';
import Stats from '../components/Stats';
import Features from '../components/Features';
import HonorsBoard from '../components/HonorsBoard';
import PublicCourses from '../components/PublicCourses';

export default function Home() {
  return (
    <div className="flex-grow">
      <Hero />
      <Stats />
      <PublicCourses />
      <Features />
      <HonorsBoard />
    </div>
  );
}
