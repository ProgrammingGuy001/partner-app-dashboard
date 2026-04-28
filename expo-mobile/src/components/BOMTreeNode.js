import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui';
import Ionicons from '@react-native-vector-icons/ionicons';

const BOMTreeNode = ({ node, depth = 0, onAddToBucket }) => {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <View>
      <View
        className={`flex-row items-center rounded-lg py-2 ${depth === 0 ? 'bg-muted/70' : ''}`}
        style={{ paddingLeft: depth * 20 + 10 }}
      >
        <Pressable onPress={() => hasChildren && setIsExpanded((prev) => !prev)} className="w-5 items-center">
          {hasChildren ? (
            <Ionicons name={isExpanded ? 'chevron-down' : 'chevron-forward'} size={16} color="#6B7280" />
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

        <Pressable onPress={() => onAddToBucket(node)} className="p-1">
          <Ionicons name="add" size={16} color="#6b4b41" />
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
