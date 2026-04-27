import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Plus } from 'lucide-react';
import type { BOMTreeNode as BOMTreeNodeType } from '@/api/bom';

interface Props {
    node: BOMTreeNodeType;
    depth?: number;
    onAddToBucket: (node: BOMTreeNodeType) => void;
}

const BOMTreeNode: React.FC<Props> = ({ node, depth = 0, onAddToBucket }) => {
    const [isExpanded, setIsExpanded] = useState(depth < 2);
    const hasChildren = node.children && node.children.length > 0;

    return (
        <div className="select-none">
            <div
                className={`flex min-w-0 items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-secondary ${depth === 0 ? 'bg-primary/5 font-semibold' : ''}`}
                style={{ paddingLeft: `clamp(0.75rem, ${depth * 1.5 + 0.75}rem, 4rem)` }}
            >
                <button
                    onClick={() => hasChildren && setIsExpanded(!isExpanded)}
                    className={`flex-shrink-0 ${!hasChildren ? 'invisible' : ''}`}
                >
                    {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                </button>

                <span className="min-w-0 flex-1 break-words text-sm">
                    {node.product_name}
                    {node.cabinet_position && (
                        <span className="ml-2 inline-block text-xs text-muted-foreground">
                            (Position: {node.cabinet_position})
                        </span>
                    )}
                </span>

                <button
                    onClick={() => onAddToBucket(node)}
                    className="flex-shrink-0 p-1.5 text-primary hover:bg-primary/10 rounded transition-colors"
                    title="Add to bucket"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            {hasChildren && isExpanded && (
                <div className="mt-1">
                    {node.children.map((child, index) => (
                        <BOMTreeNode
                            key={`${child.product_name}-${index}`}
                            node={child}
                            depth={depth + 1}
                            onAddToBucket={onAddToBucket}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default BOMTreeNode;
