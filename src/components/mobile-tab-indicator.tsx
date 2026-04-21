'use client'

import { motion } from 'framer-motion'

export default function MobileTabIndicator() {
  return (
    <motion.div
      layoutId="activeTabIndicator"
      className="w-4 h-0.5 bg-blue-700 rounded-full mt-0.5"
    />
  )
}
