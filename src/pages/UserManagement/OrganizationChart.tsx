import { useState } from 'react';
import {
    Building2, ChevronRight, ChevronDown, Plus, MapPin, Users, CornerUpLeft
} from 'lucide-react';
import clsx from 'clsx';
import { Link } from 'react-router-dom';

// Tree Node Structure
type OrgUnit = {
    id: string;
    name: string;
    type: 'Head Office' | 'Region' | 'Division' | 'Branch' | 'Team';
    code: string;
    manager: string;
    staffCount: number;
    children?: OrgUnit[];
    expanded?: boolean;
};

const INITIAL_DATA: OrgUnit = {
    id: 'root',
    name: 'ABC Corporation',
    type: 'Head Office',
    code: 'HQ-001',
    manager: 'CEO Office',
    staffCount: 850,
    expanded: true,
    children: [
        {
            id: 'NA',
            name: 'North America Region',
            type: 'Region',
            code: 'REG-NA',
            manager: 'Sarah Connor',
            staffCount: 420,
            expanded: true,
            children: [
                {
                    id: 'USA',
                    name: 'USA Division',
                    type: 'Division',
                    code: 'DIV-USA',
                    manager: 'John Matrix',
                    staffCount: 300,
                    expanded: true,
                    children: [
                        {
                            id: 'NYC',
                            name: 'New York Branch',
                            type: 'Branch',
                            code: 'BR-NYC-001',
                            manager: 'John Smith',
                            staffCount: 28,
                            children: [
                                { id: 'SALES-NYC', name: 'Sales Team A', type: 'Team', code: 'TM-NYC-S1', manager: 'Mike Ross', staffCount: 15 },
                                { id: 'OPS-NYC', name: 'Warehouse Ops', type: 'Team', code: 'TM-NYC-W1', manager: 'Darryl Philbin', staffCount: 8 }
                            ]
                        },
                        { id: 'LA', name: 'Los Angeles Branch', type: 'Branch', code: 'BR-LA-001', manager: 'Harry Tasker', staffCount: 22 }
                    ]
                },
                { id: 'CAN', name: 'Canada Division', type: 'Division', code: 'DIV-CAN', manager: 'T-800', staffCount: 120 }
            ]
        },
        {
            id: 'EU',
            name: 'Europe Region',
            type: 'Region',
            code: 'REG-EU',
            manager: 'Jean Reno',
            staffCount: 210,
            children: [
                { id: 'UK', name: 'UK Division', type: 'Division', code: 'DIV-UK', manager: 'James Bond', staffCount: 80 }
            ]
        }
    ]
};

export default function OrganizationChart() {
    const [data] = useState<OrgUnit>(INITIAL_DATA);
    const [selectedUnit, setSelectedUnit] = useState<OrgUnit | null>(INITIAL_DATA);

    // Recursive component for Tree Node
    const TreeNode = ({ node, level }: { node: OrgUnit, level: number }) => {
        const [isExpanded, setIsExpanded] = useState(node.expanded || false);
        const hasChildren = node.children && node.children.length > 0;

        return (
            <div className="select-none">
                <div
                    onClick={() => {
                        setSelectedUnit(node);
                        if (hasChildren) setIsExpanded(!isExpanded);
                    }}
                    className={clsx(
                        "flex items-center gap-2 p-2 rounded-sm cursor-pointer border hover:bg-gray-50 transition-colors",
                        selectedUnit?.id === node.id
                            ? "bg-blue-50 border-blue-200 text-blue-800"
                            : "bg-white border-transparent hover:border-gray-200 text-gray-700"
                    )}
                    style={{ paddingLeft: `${level * 20 + 8}px` }}
                >
                    <div className="w-4 h-4 flex items-center justify-center text-gray-400">
                        {hasChildren && (
                            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                        )}
                    </div>

                    <div className={clsx("p-1.5 rounded", {
                        'bg-redwood-brand text-white': node.type === 'Head Office',
                        'bg-blue-100 text-blue-700': node.type === 'Region',
                        'bg-purple-100 text-purple-700': node.type === 'Division',
                        'bg-emerald-100 text-emerald-700': node.type === 'Branch',
                        'bg-gray-100 text-gray-600': node.type === 'Team'
                    })}>
                        <Building2 size={14} />
                    </div>

                    <div className="flex-1">
                        <div className="text-sm font-bold leading-none">{node.name}</div>
                        <div className="text-[10px] opacity-60 font-mono mt-0.5">{node.type} • {node.code}</div>
                    </div>
                </div>

                {hasChildren && isExpanded && (
                    <div className="border-l border-gray-200 ml-[19px]">
                        {node.children!.map(child => (
                            <TreeNode key={child.id} node={child} level={level + 1} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-redwood-bg-light overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-redwood-border p-6 flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-black text-redwood-text-main uppercase tracking-tighter flex items-center gap-3">
                        <Building2 className="text-redwood-brand" /> Organization
                    </h1>
                    <p className="text-xs font-bold text-redwood-text-muted uppercase tracking-widest mt-1">
                        Global Operational Hierarchy
                    </p>
                </div>
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-white border border-redwood-border rounded-sm text-xs font-bold uppercase tracking-wide flex items-center gap-2 hover:bg-gray-50">
                        Import
                    </button>
                    <button className="px-4 py-2 bg-redwood-brand text-white rounded-sm text-xs font-bold uppercase tracking-wide flex items-center gap-2 hover:bg-redwood-brand/90 shadow-md">
                        <Plus size={14} /> Add Unit
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left: Tree View */}
                <div className="w-1/3 bg-white border-r border-redwood-border overflow-y-auto p-4 custom-scrollbar">
                    <div className="mb-4 flex gap-2">
                        <input type="text" placeholder="Search hierarchy..." className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm text-xs font-bold" />
                    </div>
                    <TreeNode node={data} level={0} />
                </div>

                {/* Right: Detail View */}
                <div className="flex-1 overflow-y-auto bg-gray-50 p-8 custom-scrollbar">
                    {selectedUnit ? (
                        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* Header Card */}
                            <div className="bg-white border border-redwood-border rounded-sm p-8 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Building2 size={120} />
                                </div>
                                <div className="flex items-start gap-4 relative z-10">
                                    <div className="w-16 h-16 bg-gray-100 rounded-md flex items-center justify-center text-gray-400 shadow-inner">
                                        <Building2 size={32} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <h2 className="text-2xl font-black text-redwood-text-main">{selectedUnit.name}</h2>
                                            <span className={clsx("px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider", {
                                                'bg-redwood-brand/10 text-redwood-brand': selectedUnit.type === 'Head Office',
                                                'bg-blue-100 text-blue-700': selectedUnit.type === 'Region',
                                                'bg-purple-100 text-purple-700': selectedUnit.type === 'Division',
                                                'bg-emerald-100 text-emerald-700': selectedUnit.type === 'Branch',
                                                'bg-gray-100 text-gray-600': selectedUnit.type === 'Team'
                                            })}>{selectedUnit.type}</span>
                                        </div>
                                        <div className="flex gap-6 mt-4 text-sm text-gray-600">
                                            <div className="flex items-center gap-2">
                                                <div className="font-bold text-gray-400 uppercase text-[10px]">Code</div>
                                                <div className="font-mono">{selectedUnit.code}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="font-bold text-gray-400 uppercase text-[10px]">Manager</div>
                                                <div>{selectedUnit.manager}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="font-bold text-gray-400 uppercase text-[10px]">Staff</div>
                                                <div>{selectedUnit.staffCount} users</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Stats & Info Grid */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="bg-white border border-redwood-border p-6 rounded-sm">
                                    <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-4">Contact & Location</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-3">
                                            <MapPin className="text-redwood-brand mt-0.5" size={16} />
                                            <div>
                                                <div className="text-sm font-bold text-gray-800">123 Business Park Ave</div>
                                                <div className="text-xs text-gray-500">Suite 400, New York, NY 10001</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white border border-redwood-border p-6 rounded-sm">
                                    <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-4">Financials (YTD)</h3>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Cost Center</span>
                                            <span className="font-mono font-bold">CC-{selectedUnit.code}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Budget Utilized</span>
                                            <span className="font-mono font-bold text-emerald-600">$450,200</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Assigned Staff Preview */}
                            <div className="bg-white border border-redwood-border p-6 rounded-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
                                        <Users size={14} /> Key Personnel
                                    </h3>
                                    <button className="text-[10px] font-bold text-blue-600 uppercase hover:underline">View All Staff</button>
                                </div>
                                <div className="space-y-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="flex items-center justify-between p-3 border border-gray-100 rounded hover:bg-gray-50">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">
                                                    US
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold">John Doe {i}</div>
                                                    <div className="text-[10px] text-gray-500 uppercase">Sales Manager</div>
                                                </div>
                                            </div>
                                            <div className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold uppercase rounded">Active</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center opacity-40">
                            <Building2 size={64} className="mb-4" />
                            <div className="text-xl font-bold uppercase">Select an Organizational Unit</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
