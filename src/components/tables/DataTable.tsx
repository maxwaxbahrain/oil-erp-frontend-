import { type ReactNode } from 'react';

interface Column<T> {
    header: string;
    accessor: keyof T | ((item: T) => ReactNode);
    className?: string;
    headerClassName?: string;
}

interface DataTableProps<T> {
    title: string;
    subtitle?: string;
    data: T[];
    columns: Column<T>;
    loading?: boolean;
    onRowClick?: (item: T) => void;
    actions?: ReactNode;
}

export default function DataTable<T extends { id?: string | number }>({
    title,
    subtitle,
    data,
    columns,
    loading,
    onRowClick,
    actions
}: DataTableProps<T>) {
    return (
        <div className="bg-redwood-bg-surface border border-redwood-border rounded-sm shadow-sm overflow-hidden flex flex-col min-h-[500px]">
            {/* Table Header */}
            <div className="px-6 py-5 border-b border-redwood-border bg-redwood-bg-surface flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-black text-redwood-text-main uppercase tracking-tight">{title}</h3>
                    {subtitle && <p className="text-sm text-redwood-text-muted mt-1">{subtitle}</p>}
                </div>
                {actions && <div className="flex items-center gap-3">{actions}</div>}
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="border-b border-redwood-border">
                            {(columns as any).map((col: any, i: number) => (
                                <th
                                    key={i}
                                    className={`px-6 py-3 text-left text-xs font-bold uppercase tracking-wider ${col.headerClassName || 'bg-white/5 text-redwood-text-muted'
                                        } ${col.className || ''}`}
                                >
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array(5).fill(0).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    {(columns as any).map((_: any, j: number) => (
                                        <td key={j} className="px-6 py-5">
                                            <div className="h-4 bg-white/10 rounded w-full"></div>
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={(columns as any).length} className="px-6 py-20 text-center">
                                    <div className="flex flex-col items-center">
                                        <p className="text-sm font-bold text-redwood-text-muted uppercase">No Records Found</p>
                                        <p className="text-xs text-redwood-text-muted mt-2">No data available to display</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            data.map((item, i) => (
                                <tr
                                    key={item.id || i}
                                    onClick={() => onRowClick?.(item)}
                                    className={`transition-colors cursor-pointer border-b border-redwood-border hover:bg-[rgba(79,142,247,0.07)] ${i % 2 === 0 ? 'bg-redwood-bg-surface' : 'bg-white/[0.02]'
                                        }`}
                                >
                                    {(columns as any).map((col: any, j: number) => (
                                        <td key={j} className={`px-6 py-4 text-sm ${col.className || ''}`}>
                                            {typeof col.accessor === 'function' ? col.accessor(item) : (item as any)[col.accessor]}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

        </div>
    );
}


