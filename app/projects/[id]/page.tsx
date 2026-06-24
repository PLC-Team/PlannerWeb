import dynamic from 'next/dynamic';
import ProjectLoading from './loading';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';


const ProjectClient = dynamic(() => import('./ProjectClient'), {
  ssr: false, // Ensures this huge component only renders on the client
  loading: () => <ProjectLoading /> // Show skeleton while downloading the 440KB chunk!
});

export default function ProjectPage() {
  return <ProjectClient />;
}
