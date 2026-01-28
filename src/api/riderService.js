import axios from "axios";

const UNIFIED_API_URL = import.meta.env.VITE_UNIFIED_API_URL || 'http://localhost:3001';
const RIDER_BACKEND_URL = import.meta.env.VITE_RIDER_BACKEND_URL;

const riderApiClient = axios.create({
  baseURL: RIDER_BACKEND_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

const unifiedApiClient = axios.create({
  baseURL: `${UNIFIED_API_URL}/api/unified`,
  headers: {
    "Content-Type": "application/json",
  },
});

export const submitOrderToRider = async (orderData) => {
  const response = await riderApiClient.post("/api/orders", orderData);
  return response.data;
};

export const getOrderStatus = async (orderId) => {
  try {
    if (orderId.startsWith('MYE-')) {
      const response = await unifiedApiClient.get(`/orders/${orderId}/track`);
      if (response.data.success) {
        const tracking = response.data.data;
        return {
          ...tracking.order,
          status: tracking.currentStatus,
          timeline: tracking.timeline
        };
      }
    }
    const response = await riderApiClient.get(`/api/orders/${orderId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching order status:', error);
    throw error;
  }
};

export const getAvailableOrders = async () => {
  const response = await riderApiClient.get("/api/orders/available");
  return response.data;
};

export default riderApiClient;
