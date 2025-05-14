"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { SearchBar } from "@/app/components/search-bar";
import { useState } from "react";

export default function PwaHomePage() {
  const [location, setLocation] = useState("San Francisco");
  const router = useRouter();
  
  const handleSearch = (query: string) => {
    // Redirect to search page with the query as a URL parameter
    router.push(`/search/${encodeURIComponent(query)}`);
  };
  
  const handleLocationChange = (newLocation: string) => {
    console.log("Location changed:", newLocation);
    setLocation(newLocation);
  };

  return (
    <motion.div 
      className="w-full h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <main className="isometric-grid flex flex-col items-center min-h-screen overflow-auto">
        {/* Animated grid overlay */}
        <motion.div 
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(rgba(67, 97, 238, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(67, 97, 238, 0.1) 1px, transparent 1px)",
            backgroundSize: "50px 50px"
          }}
          animate={{
            backgroundPosition: ["0px 0px", "50px 50px"],
          }}
          transition={{
            duration: 20,
            ease: "linear",
            repeat: Infinity,
          }}
        />
        
        {/* Animated glow */}
        <motion.div
          className="absolute inset-0 z-0 opacity-30 pointer-events-none"
          style={{
            background: "radial-gradient(circle at center, rgba(67, 97, 238, 0.2) 0%, transparent 70%)"
          }}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.2, 0.3, 0.2],
          }}
          transition={{
            duration: 8,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />
        
        {/* Content container with higher z-index */}
        <div className="relative z-20 w-full px-6 max-w-lg mx-auto flex flex-col items-center pt-12 pb-32">
          {/* Logo/Text */}
          <motion.h1 
            className="text-5xl font-bold text-white glow-text mb-8 relative z-20"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ 
              delay: 0.5,
              duration: 0.8,
              ease: "easeOut"
            }}
          >
            justlocal.ai
          </motion.h1>
          
          {/* Search Bar */}
          <motion.div
            className="w-full relative z-20"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ 
              delay: 0.7,
              duration: 0.8,
              ease: "easeOut"
            }}
          >
            <SearchBar
              onSearch={handleSearch}
              initialLocation={location}
              onLocationChange={handleLocationChange}
            />
          </motion.div>
          
          {/* Call to action message */}
          <motion.div
            className="mt-12 text-center text-white/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
          >
            <p className="text-sm">
              Search for local insights about {location}
            </p>
          </motion.div>
        </div>
      </main>
    </motion.div>
  );
} 