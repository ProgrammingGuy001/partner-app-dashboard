import React, { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui';
import { IconButton } from './common/Primitives';
import { radii, spacing, typography } from '../theme/designSystem';

const BOMTreeNode = ({ node, depth = 0, onAddToBucket }) => {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <View>
      <View
        className={`flex-row items-center rounded-lg py-2 ${depth === 0 ? 'bg-muted/70' : ''}`}
        style={{ paddingLeft: depth * radii.xl + spacing.sm }}
      >
        {hasChildren ? (
          <IconButton
            icon={isExpanded ? 'chevron-down' : 'chevron-forward'}
            iconSize={typography.body.fontSize}
            size={spacing.xl}
            tone="neutral"
            onPress={() => setIsExpanded((prev) => !prev)}
            label={`${isExpanded ? 'Collapse' : 'Expand'} ${node.product_name}`}
          />
        ) : <View style={{ width: spacing.xl }} />}

        <View className="ml-1 flex-1">
          <Text className="text-xs text-foreground">{node.product_name}</Text>
          {node.cabinet_position ? (
            <Text style={typography.micro} className="text-muted-foreground">Position: {node.cabinet_position}</Text>
          ) : null}
        </View>

        <IconButton
          icon="add"
          iconSize={typography.title3.fontSize}
          size={spacing.xl + spacing.xxs}
          tone="subtle"
          onPress={() => onAddToBucket(node)}
          label={`Add ${node.product_name} to bucket`}
        />
      </View>

      {hasChildren && isExpanded
        ? node.children.map((child, index) => (
            <BOMTreeNode
              key={`${child.product_name}-${index}`}
              node={child}
              depth={depth + 1}
              onAddToBucket={onAddToBucket}
            />
          ))
        : null}
    </View>
  );
};

export default BOMTreeNode;
