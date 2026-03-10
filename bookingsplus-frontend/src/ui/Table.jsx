import React from 'react';
import { clsx } from 'clsx';
import { ChevronDown, MoreVertical } from 'lucide-react';

export const Table = ({ columns, data, className }) => {
    return (
        <div className={clsx('table-container', className)}>
            <table className="z-table">
                <thead>
                    <tr>
                        {columns.map((col, index) => (
                            <th key={index} className="z-th">
                                <div className="z-th-content">
                                    {col.label}
                                    {col.sortable && <ChevronDown size={14} className="ml-1 text-gray-400" />}
                                </div>
                            </th>
                        ))}
                        <th className="z-th w-10"></th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, rowIndex) => (
                        <tr key={rowIndex} className="z-tr">
                            {columns.map((col, colIndex) => (
                                <td key={colIndex} className="z-td">
                                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                                </td>
                            ))}
                            <td className="z-td text-right">
                                <button className="icon-btn">
                                    <MoreVertical size={16} />
                                </button>
                            </td>
                        </tr>
                    ))}
                    {data.length === 0 && (
                        <tr>
                            <td colSpan={columns.length + 1} className="z-td-empty text-center py-8 text-gray-500">
                                No records found.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};
