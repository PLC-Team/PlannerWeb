const fs = require('fs');
let content = fs.readFileSync('app/dashboard/training/page.tsx', 'utf8');

// 1. Remove Type, Priority, Actions headers and Add Trainer header
content = content.replace('<th className="py-4 px-6">Type</th>', '');
content = content.replace('<th className="py-4 px-6">Priority</th>', '<th className="py-4 px-6">Trainer</th>');
content = content.replace('<th className="py-4 px-6 text-right">Actions</th>', '');

// 2. Remove Type and Priority from the filteredRequests.map row
content = content.replace(/<td className="py-3 px-6">\s*\{req\.request_type === 'planned' \? \([\s\S]*?<\/td>/, '');
content = content.replace(/<td className="py-3 px-6">\s*<span className={`inline-flex items-center px-2 py-0\.5 rounded text-xs font-medium \$\{getPriorityColor\(req\.priority\)\}`}>\s*\{req\.priority \|\| 'medium'\}\s*<\/span>\s*<\/td>/, '<td className="py-3 px-6 text-sm text-[#F8FAFC]">{req.trainer?.name || req.trainer_name || \'-\'}</td>');

// 3. Remove Actions from the row
content = content.replace(/<td className="py-3 px-6 text-right">\s*<button className="text-slate-400 group-hover:text-\[#F8FAFC\] transition-colors p-1 rounded-md hover:bg-\[#1E293B\]">\s*<MoreVertical className="w-4 h-4" \/>\s*<\/button>\s*<\/td>/, '');

// 4. Remove Priority from New Request Modal
content = content.replace(/<div>\s*<label className="block text-sm font-semibold text-slate-300 mb-1\.5">Priority<\/label>\s*<select[\s\S]*?<\/select>\s*<\/div>/g, '');

// 5. Add Delete button in the Drawer for Managers
const deleteButtonStr = `
                      <button type="button" onClick={async () => {
                        if (confirm('Are you sure you want to delete this request?')) {
                          await supabase.from('training_requests').delete().eq('id', selectedRequest.id);
                          setIsDrawerOpen(false);
                          mutate();
                        }
                      }} className="w-full bg-red-500/10 text-red-400 font-bold text-sm py-2 rounded-lg hover:bg-red-500/20 transition-colors mt-2">
                        Delete Request
                      </button>
                    `;
content = content.replace(/(<button type="submit" disabled=\{isSubmitting\}[\s\S]*?Update Status\s*<\/button>)/, '$1' + deleteButtonStr);

fs.writeFileSync('app/dashboard/training/page.tsx', content);
