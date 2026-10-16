import type { MenuComponentProps, MenuComponentRef } from '@expo/ui/community/menu';
import { Button, ContextMenu, Host, RNHostView } from '@expo/ui/swift-ui';
import type { Ref } from 'react';
import { StyleSheet } from 'react-native';

import { TouchTarget } from '@/constants/theme';

/**
 * A long-press context menu around a one-line list row. @expo/ui's MenuView sizes the row from its
 * content on both axes. A row with no fixed width then measures 0 wide and does not show, and a
 * content-sized height measures 0 and the rows overlap. Here the row has the list's width and a
 * fixed height: the row's own minimum, TouchTarget.
 */
export function RowMenu({
  actions,
  onPressAction,
  children,
}: Pick<MenuComponentProps, 'actions' | 'onPressAction' | 'children'> & { ref?: Ref<MenuComponentRef>; shouldOpenOnLongPress?: boolean }) {
  return (
    <Host style={styles.row} ignoreSafeArea="all">
      <ContextMenu>
        <ContextMenu.Trigger>
          <RNHostView>
            <>{children}</>
          </RNHostView>
        </ContextMenu.Trigger>
        <ContextMenu.Items>
          {actions.map((action) => (
            <Button
              key={action.id ?? action.title}
              label={action.title}
              systemImage={typeof action.image === 'string' ? action.image : undefined}
              role={action.attributes?.destructive ? 'destructive' : undefined}
              onPress={() => onPressAction?.({ nativeEvent: { event: action.id ?? action.title } })}
            />
          ))}
        </ContextMenu.Items>
      </ContextMenu>
    </Host>
  );
}

const styles = StyleSheet.create({ row: { alignSelf: 'stretch', height: TouchTarget } });
