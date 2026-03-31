import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET() {
  const sampleProducts = [
    {
      name: 'Classic Cheeseburger',
      description: 'Juicy beef patty with cheddar cheese, lettuce, tomato, and our special sauce.',
      price: 2500,
      category: 'fast_food',
      image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400',
    },
    {
      name: 'Crispy Fried Chicken',
      description: 'Golden fried chicken served with fries and coleslaw.',
      price: 3000,
      category: 'fast_food',
      image_url: 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=400',
    },
    {
      name: 'Jollof Rice with Chicken',
      description: 'Classic Nigerian jollof rice served with grilled chicken and plantains.',
      price: 3500,
      category: 'regular',
      image_url: 'https://images.unsplash.com/photo-1617098900591-3d909b73a856?w=400',
    },
    {
      name: 'Egusi Soup with Pounded Yam',
      description: 'Rich melon seed soup with assorted meat and pounded yam.',
      price: 4000,
      category: 'regular',
      image_url: 'https://images.unsplash.com/photo-1616684000067-36952fde56ec?w=400',
    },
    {
      name: 'Vegetable Fried Rice',
      description: 'Chinese-style fried rice with mixed vegetables and eggs.',
      price: 2800,
      category: 'chinese',
      image_url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400',
    },
    {
      name: 'Sweet & Sour Chicken',
      description: 'Crispy chicken chunks in tangy sweet and sour sauce with bell peppers.',
      price: 3800,
      category: 'chinese',
      image_url: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=400',
    },
    {
      name: 'Spring Rolls (4 pcs)',
      description: 'Crispy vegetable spring rolls with sweet chili dipping sauce.',
      price: 1500,
      category: 'chinese',
      image_url: 'https://images.unsplash.com/photo-1568301184648-207d9e3f0c5d?w=400',
    },
    {
      name: 'Beef Shawarma',
      description: 'Grilled beef wrapped in pita bread with garlic sauce and vegetables.',
      price: 2200,
      category: 'fast_food',
      image_url: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400',
    },
    {
      name: 'Pounded Yam with Ogbono Soup',
      description: 'Smooth pounded yam served with rich ogbono soup and assorted meat.',
      price: 3800,
      category: 'regular',
      image_url: 'https://images.unsplash.com/photo-1616684000067-36952fde56ec?w=400',
    },
  ];

  const { data, error } = await supabase.from('products').insert(sampleProducts).select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, products: data });
}