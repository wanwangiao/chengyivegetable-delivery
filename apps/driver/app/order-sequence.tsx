import { useCallback, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { Button, Card, Divider, IconButton, Text, Portal, Modal } from 'react-native-paper';
import { type Order } from '@chengyi/domain';

// 簡約配色
const COLORS = {
  primary: '#2C3E50',
  secondary: '#546E7A',
  background: '#ECEFF1',
  white: '#FFFFFF',
  success: '#66BB6A',
  warning: '#FFA726',
  error: '#EF5350',
  info: '#42A5F5'
};

interface OrderSequenceModalProps {
  visible: boolean;
  orders: Order[];
  currentIndex: number;
  onDismiss: () => void;
  onReorder: (newOrders: Order[]) => void;
  onSelectOrder: (index: number) => void;
}

export default function OrderSequenceModal({
  visible,
  orders,
  currentIndex,
  onDismiss,
  onReorder,
  onSelectOrder
}: OrderSequenceModalProps) {
  const [editingOrders, setEditingOrders] = useState<Order[]>(orders);
  const [isDragging, setIsDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index === 0) return;
      const newOrders = [...editingOrders];
      [newOrders[index - 1], newOrders[index]] = [newOrders[index], newOrders[index - 1]];
      setEditingOrders(newOrders);
    },
    [editingOrders]
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index === editingOrders.length - 1) return;
      const newOrders = [...editingOrders];
      [newOrders[index], newOrders[index + 1]] = [newOrders[index + 1], newOrders[index]];
      setEditingOrders(newOrders);
    },
    [editingOrders]
  );

  const handleSave = useCallback(() => {
    onReorder(editingOrders);
    onDismiss();
  }, [editingOrders, onDismiss, onReorder]);

  const handleReset = useCallback(() => {
    setEditingOrders(orders);
  }, [orders]);

  const handleSelectOrder = useCallback(
    (index: number) => {
      onSelectOrder(index);
      onDismiss();
    },
    [onDismiss, onSelectOrder]
  );

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text variant="titleLarge" style={styles.modalTitle}>
              調整配送順序
            </Text>
            <IconButton icon="close" size={24} onPress={onDismiss} />
          </View>

          <Divider style={styles.divider} />

          <ScrollView style={styles.orderList} contentContainerStyle={styles.orderListContent}>
            {editingOrders.map((order, index) => (
              <TouchableOpacity
                key={order.id}
                onPress={() => handleSelectOrder(index)}
                activeOpacity={0.7}
              >
                <Card
                  style={[
                    styles.orderCard,
                    index === currentIndex && styles.currentOrderCard
                  ]}
                >
                  <Card.Content style={styles.orderCardContent}>
                    <View style={styles.orderInfo}>
                      <View style={styles.orderNumber}>
                        <Text variant="titleMedium" style={styles.orderNumberText}>
                          {index + 1}
                        </Text>
                      </View>

                      <View style={styles.orderDetails}>
                        <Text variant="titleSmall" style={styles.orderName}>
                          {order.contactName}
                        </Text>
                        <Text variant="bodySmall" style={styles.orderAddress} numberOfLines={1}>
                          {order.address}
                        </Text>
                        <Text variant="bodySmall" style={styles.orderPhone}>
                          {order.contactPhone}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.orderActions}>
                      <IconButton
                        icon="arrow-up"
                        size={20}
                        disabled={index === 0}
                        onPress={() => handleMoveUp(index)}
                        iconColor={index === 0 ? COLORS.secondary + '50' : COLORS.primary}
                      />
                      <IconButton
                        icon="arrow-down"
                        size={20}
                        disabled={index === editingOrders.length - 1}
                        onPress={() => handleMoveDown(index)}
                        iconColor={
                          index === editingOrders.length - 1
                            ? COLORS.secondary + '50'
                            : COLORS.primary
                        }
                      />
                    </View>
                  </Card.Content>
                </Card>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Divider style={styles.divider} />

          <View style={styles.modalFooter}>
            <Button mode="outlined" onPress={handleReset} textColor={COLORS.secondary}>
              重置
            </Button>
            <Button
              mode="contained"
              onPress={handleSave}
              buttonColor={COLORS.primary}
              textColor={COLORS.white}
            >
              確認調整
            </Button>
          </View>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    backgroundColor: 'transparent',
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8
  },
  modalTitle: {
    color: COLORS.primary,
    fontWeight: '600'
  },
  divider: {
    backgroundColor: COLORS.secondary + '30'
  },
  orderList: {
    flex: 1
  },
  orderListContent: {
    padding: 16,
    gap: 12
  },
  orderCard: {
    backgroundColor: COLORS.white,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    marginBottom: 8
  },
  currentOrderCard: {
    borderWidth: 2,
    borderColor: COLORS.info,
    backgroundColor: COLORS.info + '10'
  },
  orderCardContent: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  orderInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  orderNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.secondary + '20',
    justifyContent: 'center',
    alignItems: 'center'
  },
  orderNumberText: {
    color: COLORS.primary,
    fontWeight: '700'
  },
  orderDetails: {
    flex: 1,
    gap: 2
  },
  orderName: {
    color: COLORS.primary,
    fontWeight: '600'
  },
  orderAddress: {
    color: COLORS.secondary
  },
  orderPhone: {
    color: COLORS.secondary,
    fontSize: 11
  },
  orderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12
  }
});
