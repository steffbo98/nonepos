export async function getSalesInsights(salesData: any[]) {
  if (!Array.isArray(salesData) || salesData.length === 0) {
    return "No recent sales data is available yet. Check back when orders are recorded.";
  }

  const totalSales = salesData.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
  const averageSale = totalSales / salesData.length;
  const sortedByTotal = [...salesData].sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0));
  const highestOrder = sortedByTotal[0];
  const lowSalesCount = salesData.filter(order => Number(order.total) < averageSale * 0.7).length;

  const insights = [
    `Recent sales show a total of Ksh ${Math.round(totalSales).toLocaleString()} across ${salesData.length} orders, with an average order size of Ksh ${Math.round(averageSale).toLocaleString()}.`,
    `The highest-value order recorded was Ksh ${Math.round(Number(highestOrder.total) || 0).toLocaleString()} on ${highestOrder.date || 'an earlier date'}.`,
    `Around ${Math.round((lowSalesCount / salesData.length) * 100)}% of the sampled orders are below 70% of the average sale, which may indicate pricing or product mix adjustments could improve revenue.`
  ];

  return insights.join(' ');
}

export async function getInventoryForecast(inventoryData: any[]) {
  if (!Array.isArray(inventoryData) || inventoryData.length === 0) {
    return "Inventory forecast unavailable until stock data is available.";
  }

  const lowStockItems = inventoryData.filter(item => Number(item.stock) < 10).map(item => item.name || item.id || 'Unnamed item');
  const categories = Array.from(new Set(inventoryData.map(item => item.category).filter(Boolean)));

  const insights = [
    `There are ${lowStockItems.length} items with low stock levels.`,
    categories.length > 0
      ? `Inventory spans ${categories.length} categories, with the top categories requiring closer restock planning.`
      : `Inventory category information is not complete yet.`,
    lowStockItems.length > 0
      ? `Focus restocking on: ${lowStockItems.slice(0, 5).join(', ')}.`
      : `Stock levels are generally healthy for the current catalog.`
  ];

  return insights.join(' ');
}
