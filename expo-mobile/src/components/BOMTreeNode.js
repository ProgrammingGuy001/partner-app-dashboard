import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../hooks/useTheme';

const BOMTreeNode = ({ node, depth = 0, onAddToBucket }) => {
  const { colors } = useTheme();
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <View>
      <View
        className={`flex-row items-center rounded-lg py-2 ${depth === 0 ? 'bg-muted/70' : ''}`}
        style={{ paddingLeft: depth * 20 + 10 }}
      >
        <Pressable
          onPress={() => hasChildren && setIsExpanded((prev) => !prev)}
          className="w-8 h-8 items-center justify-center rounded-lg"
          accessibilityRole={hasChildren ? 'button' : 'none'}
          accessibilityLabel={hasChildren ? `${isExpanded ? 'Collapse' : 'Expand'} ${node.product_name}` : undefined}
          accessibilityState={hasChildren ? { expanded: isExpanded } : undefined}
        >
          {hasChildren ? (
            <Ionicons name={isExpanded ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.textMuted} />
          ) : (
            <View className="w-[14px]" />
          )}
        </Pressable>

        <View className="ml-1 flex-1">
          <Text className="text-xs text-foreground">{node.product_name}</Text>
          {node.cabinet_position ? (
            <Text className="text-[11px] text-muted-foreground">Position: {node.cabinet_position}</Text>
          ) : null}
        </View>

        <Pressable
          onPress={() => onAddToBucket(node)}
          className="h-9 w-9 items-center justify-center rounded-xl bg-primary-light"
          accessibilityRole="button"
          accessibilityLabel={`Add ${node.product_name} to bucket`}
        >
          <Ionicons name="add" size={17} color={colors.primary} />
        </Pressable>
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
