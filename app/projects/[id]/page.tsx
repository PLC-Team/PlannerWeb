import dynamic from 'next/dynamic';

const ProjectClient = dynamic(() => import('./ProjectClient'), {
  ssr: false, // Ensures this huge component only renders on the client
});

export default function ProjectPage() {
  return <ProjectClient />;
}
