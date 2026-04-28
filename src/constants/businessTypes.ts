
export type StorePurpose = 
  | 'General Hardware' 
  | 'Supermarket' 
  | 'Hypermarket' 
  | 'Retail Shop' 
  | 'Kiosk' 
  | 'Plumbing' 
  | 'Electrical' 
  | 'Auto Spare Shop' 
  | 'Electrical & Computers'
  | 'Hotel / Restaurant'
  | 'Boutique / Fashion'
  | 'Pharmacy / Chemist'
  | 'Beauty & Cosmetics';

export const BUSINESS_TYPES: Record<StorePurpose, string[]> = {
  'General Hardware': [
    'Nails', 
    'Cements', 
    'Iron Sheets', 
    'Paint', 
    'Tools', 
    'Plumbing', 
    'Electrical', 
    'Timber', 
    'Safety Gear',
    'Garden Tools',
    'General'
  ],
  'Supermarket': [
    'Food & Beverage',
    'Household',
    'Health & Beauty',
    'Clothing',
    'Snacks',
    'Toiletries',
    'Utensils',
    'Stationery',
    'Dairy',
    'Produce',
    'General'
  ],
  'Hypermarket': [
    'Food & Beverage',
    'Household',
    'Health & Beauty',
    'Clothing',
    'Electronics',
    'Furniture',
    'Automotive',
    'Garden',
    'Appliances',
    'Sports',
    'Toys',
    'Books & Stationery',
    'General'
  ],
  'Retail Shop': [
    'General',
    'Snacks',
    'Beverages',
    'Household',
    'Personal Care',
    'Cigarettes & Tobacco',
    'Mobile Minutes/Data'
  ],
  'Kiosk': [
    'Airtime',
    'Snacks',
    'Soft Drinks',
    'Small Household',
    'General'
  ],
  'Plumbing': [
    'Pipes',
    'Fittings',
    'Valves',
    'Pumps',
    'Tanks',
    'Sanitary Ware',
    'Tools & Adhesive',
    'General'
  ],
  'Electrical': [
    'Lighting',
    'Cables & Wires',
    'Switches & Sockets',
    'Circuit Breakers',
    'Solar Equipment',
    'Power Backup',
    'Tools',
    'General'
  ],
  'Auto Spare Shop': [
    'Engine Parts',
    'Suspension & Steering',
    'Braking System',
    'Auto Electrical',
    'Lubricants & Oils',
    'Filters',
    'Body Parts',
    'Tires & Wheels',
    'General'
  ],
  'Electrical & Computers': [
    'Laptops',
    'Desktops',
    'Components',
    'Accessories',
    'Networking',
    'Storage',
    'Software',
    'Repair Services',
    'General'
  ],
  'Hotel / Restaurant': [
    'Breakfast',
    'Main Course',
    'Appetizers',
    'Desserts',
    'Soft Drinks',
    'Alcoholic Drinks',
    'Accommodation',
    'Laundry Services',
    'General'
  ],
  'Boutique / Fashion': [
    'Men\'s Wear',
    'Women\'s Wear',
    'Kids\' Wear',
    'Shoes',
    'Accessories',
    'Jewelry',
    'Bags',
    'Perfumes',
    'General'
  ],
  'Pharmacy / Chemist': [
    'Prescription Meds',
    'OTC Medicines',
    'Pain Relief',
    'Vitamins & Supplements',
    'First Aid',
    'Baby Care',
    'Personal Care',
    'Medical Supplies',
    'General'
  ],
  'Beauty & Cosmetics': [
    'Skincare',
    'Makeup',
    'Hair Care',
    'Fragrances',
    'Nail Care',
    'Personal Hygiene',
    'Men\'s Grooming',
    'Beauty Tools',
    'General'
  ]
};
