export default function Loading() {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col animate-in fade-in duration-300">
      {/* Header Skeleton */}
      <div className="bg-white border-b border-[#e2e8f0] px-6 py-4 flex justify-between items-center shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[#e2e8f0] rounded-full animate-pulse"></div>
          <div>
            <div className="h-6 w-48 bg-[#e2e8f0] rounded animate-pulse mb-2"></div>
            <div className="h-4 w-32 bg-[#e2e8f0] rounded animate-pulse"></div>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="w-24 h-10 bg-[#e2e8f0] rounded-lg animate-pulse hidden sm:block"></div>
          <div className="w-24 h-10 bg-[#e2e8f0] rounded-lg animate-pulse hidden sm:block"></div>
          <div className="w-10 h-10 bg-[#e2e8f0] rounded-full animate-pulse"></div>
        </div>
      </div>
      
      {/* Content Skeleton */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Top Metric Cards Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           {[1, 2, 3, 4].map(i => (
             <div key={i} className="bg-white h-24 rounded-2xl shadow-sm border border-[#e2e8f0] animate-pulse"></div>
           ))}
        </div>

        {/* Tabs Skeleton */}
        <div className="flex gap-2 overflow-hidden pb-2">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-10 w-28 bg-[#e2e8f0] rounded-lg animate-pulse flex-shrink-0"></div>
          ))}
        </div>
        
        {/* Main Content Area Skeleton */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-6 flex-1 flex flex-col gap-4">
           <div className="flex justify-between items-center mb-4">
             <div className="h-8 w-64 bg-[#e2e8f0] rounded animate-pulse"></div>
             <div className="h-8 w-32 bg-[#e2e8f0] rounded animate-pulse"></div>
           </div>
           {[1, 2, 3, 4, 5].map(i => (
             <div key={i} className="h-20 w-full bg-[#f1f5f9] rounded-xl animate-pulse"></div>
           ))}
        </div>
      </div>
    </div>
  );
}
