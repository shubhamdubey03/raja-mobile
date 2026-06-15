/**
 * P5-16 — Order Detail Screen with Razorpay Retry Payment Flow
 * Supply Setu premium design
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RazorpayCheckout from 'react-native-razorpay';
import api from '../../services/api';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../theme';
import { formatINR, formatDateSecure } from '../../utils/helpers';
import { Config } from '../../config';
import { useAppSelector } from '../../hooks/useRedux';
import { Calendar, MapPin, Package, CreditCard, ChevronRight } from 'lucide-react-native';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: 'PENDING',           color: '#725B00', bg: '#FFF9E6' },
  confirmed:  { label: 'CONFIRMED',         color: '#1A5CB3', bg: '#E8F0FE' },
  dispatched: { label: 'PENDING SHIPMENT',  color: '#C07000', bg: '#FFF3CD' },
  delivered:  { label: 'DELIVERED',         color: '#23501D', bg: '#EAF2E8' },
  cancelled:  { label: 'CANCELLED',         color: '#BA1A1A', bg: '#FFDAD6' },
  processing: { label: 'PROCESSING',        color: '#6B7280', bg: '#F0EDEB' },
};

const OrderDetailScreen: React.FC<{ route: any; navigation: any }> = ({ route, navigation }) => {
  const { orderId, order: initialOrder } = route.params;
  const [order, setOrder] = useState<any>(initialOrder);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const user = useAppSelector(s => s.auth.user);

  const status = order?.status?.toLowerCase() ?? 'pending';
  const statusConf = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;

  const dateStr = formatDateSecure(order?.created_at);

  const fetchOrderDetails = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/orders/${orderId}`);
      setOrder(data);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to refresh order details');
    } finally {
      setLoading(false);
    }
  };

  const handlePayNow = async () => {
    setPaying(true);
    try {
      // 1. Initiate payment gateway transaction on backend
      const { data: paymentData } = await api.post('/payments/initiate', {
        order_id: order.id,
      });

      // 2. Trigger Razorpay Checkout UI
      const options = {
        description: `Order ${order.order_number}`,
        image: 'https://i.imgur.com/3g7urwK.png',
        currency: 'INR',
        key: Config.RAZORPAY_KEY,
        amount: order.grand_total, // in paise
        name: 'Supply Setu',
        order_id: paymentData.gateway_order_id,
        prefill: {
          contact: user?.mobile || '',
          name: user?.full_name || '',
          email: '',
        },
        theme: { color: Colors.primary },
      };

      const rzpResponse = await RazorpayCheckout.open(options);

      // 3. Verify signature on successful payment on backend
      const { data: verifyData } = await api.post('/payments/verify', {
        razorpay_order_id: rzpResponse.razorpay_order_id,
        razorpay_payment_id: rzpResponse.razorpay_payment_id,
        razorpay_signature: rzpResponse.razorpay_signature,
      });

      Alert.alert('Payment Success', 'Your payment has been successfully verified!');
      // Refresh order to reflect updated status
      fetchOrderDetails();
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || err.description || 'Payment process was cancelled or failed.';
      Alert.alert('Payment Failed', msg);
    } finally {
      setPaying(false);
    }
  };

  if (!order) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Order Header info */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.orderNum}>#{order.order_number}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusConf.bg }]}>
              <Text style={[styles.statusText, { color: statusConf.color }]}>{statusConf.label}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Calendar size={14} color={Colors.textMuted} />
            <Text style={styles.metaText}>{dateStr}</Text>
          </View>
        </View>

        {/* Address Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <View style={styles.addressRow}>
            <MapPin size={16} color={Colors.primary} style={styles.addressIcon} />
            <Text style={styles.addressText}>{order.delivery_address || 'No address specified'}</Text>
          </View>
        </View>

        {/* Items Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          {order.items?.map((item: any, index: number) => (
            <View key={item.id || index} style={styles.itemRow}>
              <View style={styles.itemLeft}>
                <Package size={20} color={Colors.textSecondary} />
                <View style={styles.itemDetails}>
                  <Text style={styles.itemName}>{item.product_name || 'Product'}</Text>
                  <Text style={styles.itemSub}>
                    {item.quantity} units x {formatINR(item.unit_price)}
                  </Text>
                </View>
              </View>
              <Text style={styles.itemTotal}>{formatINR(item.line_total)}</Text>
            </View>
          ))}
        </View>

        {/* Price summary */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Price Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryVal}>{formatINR(order.subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>GST</Text>
            <Text style={styles.summaryVal}>{formatINR(order.gst_amount)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Grand Total</Text>
            <Text style={styles.grandTotalVal}>{formatINR(order.grand_total)}</Text>
          </View>
        </View>

        {/* Pay Now block */}
        {status === 'pending' && (
          <TouchableOpacity
            style={styles.payBtn}
            onPress={handlePayNow}
            disabled={paying}
            activeOpacity={0.8}>
            {paying ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <>
                <CreditCard size={18} color={Colors.white} />
                <Text style={styles.payBtnTxt}>Pay Now ({formatINR(order.grand_total)})</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F1EC' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F1EC' },
  content: { padding: Spacing.md, gap: Spacing.md },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  orderNum: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  metaText: { fontSize: Typography.caption, color: Colors.textMuted },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs },
  addressIcon: { marginTop: 2 },
  addressText: { fontSize: Typography.caption, color: Colors.textSecondary, flex: 1, lineHeight: 18 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: '#F0EBE6' },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  itemDetails: { flex: 1 },
  itemName: { fontSize: Typography.caption, fontWeight: '700', color: Colors.textPrimary },
  itemSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  itemTotal: { fontSize: Typography.caption, fontWeight: '700', color: Colors.textPrimary },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { fontSize: Typography.caption, color: Colors.textSecondary },
  summaryVal: { fontSize: Typography.caption, fontWeight: '600', color: Colors.textPrimary },
  grandTotalRow: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 6, paddingTop: 10 },
  grandTotalLabel: { fontSize: Typography.body, fontWeight: '800', color: Colors.textPrimary },
  grandTotalVal: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    ...Shadow.md,
  },
  payBtnTxt: { color: Colors.white, fontWeight: '700', fontSize: Typography.body },
});

export default OrderDetailScreen;
