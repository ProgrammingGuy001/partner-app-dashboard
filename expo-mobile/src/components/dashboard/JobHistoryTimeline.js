import React from 'react';
import { View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Text } from '@/components/ui/text';

const STATUS_META = {
  created:     { icon: 'add-circle-outline',   color: '#6b7280', bg: 'bg-muted'      },
  in_progress: { icon: 'play-circle-outline',  color: '#3b82f6', bg: 'bg-blue-100'   },
  paused:      { icon: 'pause-circle-outline', color: '#f59e0b', bg: 'bg-amber-100'  },
  completed:   { icon: 'checkmark-circle',     color: '#22c55e', bg: 'bg-green-100'  },
  cancelled:   { icon: 'close-circle-outline', color: '#ef4444', bg: 'bg-red-100'    },
};

const formatTimestamp = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const JobHistoryTimeline = ({ history = [] }) => {
  if (!history.length) return null;

  return (
    <View className="gap-0">
      {history.map((entry, index) => {
        const meta = STATUS_META[entry.status] ?? STATUS_META.created;
        const isLast = index === history.length - 1;
        return (
          <View key={index} className="flex-row gap-3">
            {/* Timeline line + dot */}
            <View className="items-center w-6">
              <View
                className={`w-6 h-6 rounded-full items-center justify-center ${meta.bg}`}
              >
                <Ionicons name={meta.icon} size={14} color={meta.color} />
              </View>
              {!isLast && (
                <View className="w-0.5 flex-1 bg-border my-0.5" />
              )}
            </View>
            {/* Entry content */}
            <View className={`flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
              <Text className="text-[13px] font-bold text-foreground capitalize">
                {entry.status?.replaceAll('_', ' ')}
              </Text>
              <Text className="text-[11px] text-muted-foreground mt-0.5">
                {formatTimestamp(entry.changed_at)}
                {entry.changed_by ? ` · ${entry.changed_by}` : ''}
              </Text>
              {entry.notes ? (
                <Text className="text-xs text-muted-foreground mt-1 italic">
                  "{entry.notes}"
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
};

export default JobHistoryTimeline;
