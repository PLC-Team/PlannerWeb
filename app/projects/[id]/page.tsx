import dynamic from 'next/dynamic';
import ProjectLoading from './loading';

const ProjectClient = dynamic(() => import('./ProjectClient'), {
  ssr: false, // Ensures this huge component only renders on the client
  loading: () => <ProjectLoading /> // Show skeleton while downloading the 440KB chunk!
});

export default function ProjectPage() {
  return <ProjectClient />;
}
