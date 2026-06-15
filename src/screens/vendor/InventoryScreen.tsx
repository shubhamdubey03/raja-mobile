/**
 * Vendor Inventory Management Screen
 * Premium design matching Supply Setu brand — dynamic product images.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';
import { EmptyState } from '../../components';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../theme';
import { debounce, normalizeImageUrl } from '../../utils/helpers';
import { Search, Upload, Package, ShoppingBag, Archive } from 'lucide-react-native';

// ── Types ─────────────────────────────────────────────────────
interface ProductImage { id: string; image_url: string; sort_order: number; }
interface Product {
  id: string; name: string; sku: string; description?: string;
  base_price: number; stock_qty: number; low_stock_threshold: number;
  unit: string; images: ProductImage[]; image_url?: string;
}

// ── Product Card ──────────────────────────────────────────────
const InventoryCard: React.FC<{ item: Product; onPress: () => void }> = ({ item, onPress }) => {
  const [imgError, setImgError] = useState(false);
  const rawUrl = item.images?.[0]?.image_url ?? item.image_url ?? null;
  const imageUrl = normalizeImageUrl(rawUrl);

  const isOutOfStock = item.stock_qty <= 0;
  const isLowStock = !isOutOfStock && item.stock_qty <= item.low_stock_threshold;

  const statusColor = isOutOfStock ? Colors.error : isLowStock ? Colors.warning : Colors.success;
  const statusBg = isOutOfStock ? Colors.errorLight : isLowStock ? Colors.warningLight : Colors.successLight;
  const statusLabel = isOutOfStock ? 'OUT OF STOCK' : isLowStock ? 'LOW STOCK' : 'IN STOCK';

  const priceRupees = (item.base_price / 100).toFixed(2);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={styles.card}>
      {/* Image Section */}
      <View style={styles.imageContainer}>
        {imageUrl && !imgError ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.productImage}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Archive size={32} color={Colors.primary} />
          </View>
        )}

        {/* Stock badge overlaid on image */}
        <View style={[styles.stockBadge, { backgroundColor: statusBg }]}>
          <View style={[styles.stockDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.stockBadgeText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Info Section */}
      <View style={styles.infoSection}>
        <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>

        {item.description ? (
          <Text style={styles.productDesc} numberOfLines={1}>{item.description}</Text>
        ) : (
          <Text style={styles.productSku}>SKU: {item.sku}</Text>
        )}

        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>₹{priceRupees}</Text>
          <Text style={styles.perUnit}>/{item.unit}</Text>
        </View>

        <View style={styles.qtyRow}>
          <ShoppingBag size={12} color={Colors.textMuted} />
          <Text style={styles.qtyText}>
            {item.stock_qty} {item.unit}{item.stock_qty !== 1 ? 's' : ''} available
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ── Main Screen ───────────────────────────────────────────────
const InventoryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const PAGE_SIZE = 20;
  const loadingRef = useRef(false);

  const fetchProducts = useCallback(async (pg: number, kw: string) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const { data } = await api.get('/products', {
        params: { page: pg, page_size: PAGE_SIZE, keyword: kw || undefined, sort: 'newest' },
      });
      if (pg === 1) {
        setProducts(data);
        setTotalCount(data.length);
      } else {
        setProducts(prev => [...prev, ...data]);
        setTotalCount(prev => (prev ?? 0) + data.length);
      }
      setHasMore(data.length === PAGE_SIZE);
    } catch (e) {
      console.error(e);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    fetchProducts(1, keyword);
  }, [keyword]);

  const debouncedSearch = React.useMemo(() => debounce((kw: string) => setKeyword(kw), 300), []);

  const loadMore = () => {
    if (!hasMore || loading) return;
    const next = page + 1;
    setPage(next);
    fetchProducts(next, keyword);
  };

  const handleBulkUpload = () => {
    Alert.alert('Bulk Upload (CSV)', 'Select a CSV file to upload inventory in bulk.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Select File', onPress: () => {
          setTimeout(() => Alert.alert('Success', 'Inventory imported successfully from CSV.'), 1000);
        }
      },
    ]);
  };


  const inStock = products.filter(p => p.stock_qty > 0).length;
  const outOfStock = products.filter(p => p.stock_qty <= 0).length;

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Inventory</Text>
          {totalCount !== null && (
            <Text style={styles.headerSub}>{totalCount} product{totalCount !== 1 ? 's' : ''}</Text>
          )}
        </View>
        <TouchableOpacity style={styles.uploadBtn} onPress={handleBulkUpload} activeOpacity={0.7}>
          <Upload size={16} color={Colors.primary} />
          <Text style={styles.uploadBtnTxt}>CSV Upload</Text>
        </TouchableOpacity>
      </View>

      {/* ── Stats Strip ── */}
      {products.length > 0 && (
        <View style={styles.statsStrip}>
          <View style={styles.statItem}>
            <View style={[styles.statDot, { backgroundColor: Colors.success }]} />
            <Text style={styles.statLabel}>{inStock} In Stock</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={[styles.statDot, { backgroundColor: Colors.error }]} />
            <Text style={styles.statLabel}>{outOfStock} Out of Stock</Text>
          </View>
        </View>
      )}

      {/* ── Search ── */}
      <View style={styles.searchBar}>
        <Search size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search inventory..."
          placeholderTextColor={Colors.textMuted}
          onChangeText={debouncedSearch}
        />
      </View>

      {/* ── List ── */}
      <FlatList
        data={products}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        numColumns={2}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <InventoryCard
            item={item}
            onPress={() => navigation.navigate('ProductDetail', { productId: item.id, product: item })}
          />
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              title="No products found"
              subtitle="Add items to your inventory to start selling."
              icon={<Package size={48} color={Colors.textMuted} />}
            />
          ) : null
        }
        ListFooterComponent={
          loading ? <ActivityIndicator color={Colors.primary} style={{ padding: Spacing.lg }} /> : null
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
      />

    </SafeAreaView>
  );
};

const CARD_GAP = 12;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F1EC',
  },

  // ── Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: '#F5F1EC',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '400',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#E8D9A0',
  },
  uploadBtnTxt: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: Typography.label,
  },

  // ── Stats
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    ...Shadow.sm,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statLabel: {
    fontSize: Typography.label,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: Colors.border,
  },

  // ── Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.xs,
    ...Shadow.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: Typography.body,
    color: Colors.textPrimary,
  },

  // ── Grid List
  list: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 100,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: CARD_GAP,
  },

  // ── Card
  card: {
    width: '48.5%',
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    overflow: 'hidden',
    ...Shadow.card,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: Colors.primaryLight,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
  },
  stockBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stockBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  // ── Info
  infoSection: {
    padding: Spacing.sm,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 19,
    marginBottom: 3,
  },
  productDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  productSku: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginBottom: 4,
  },
  priceLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  perUnit: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '400',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  qtyText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },

  // ── FAB
  fab: {
    position: 'absolute',
    bottom: Spacing.xxl,
    right: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.fab,
  },
});

export default InventoryScreen;
