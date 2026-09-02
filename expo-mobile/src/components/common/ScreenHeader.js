import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui';
import { typography } from '../../theme/designSystem';

/**
 * Shared screen header — keeps title/subtitle typography and spacing
 * consistent across screens. Purely presentational.
 *
 * Props:
 *  - eyebrow:  small uppercase label rendered above the title (optional)
 *  - title:    main heading (string or node)
 *  - subtitle: secondary line rendered below the title (optional)
 *  - right:    node rendered on the trailing side (actions / avatar)
 */
const ScreenHeader = ({ eyebrow, title, subtitle, right, className = '' }) => (
  <View className={`flex-row items-end justify-between pt-5 mb-6 ${className}`}>
    <View className="flex-1 mr-3">
      {eyebrow ? (
        <Text className="font-semibold text-muted-foreground uppercase mb-1" style={{ fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight }}>
          {eyebrow}
        </Text>
      ) : null}
      {typeof title === 'string' ? (
        <Text className="text-2xl font-extrabold text-foreground">
          {title}
        </Text>
      ) : (
        title
      )}
      {subtitle ? (
        <Text className="mt-1 font-medium text-muted-foreground" style={{ fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
    {right ? <View>{right}</View> : null}
  </View>
);

export default ScreenHeader;
