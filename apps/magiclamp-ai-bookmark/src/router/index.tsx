import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import AIAssistant from '../pages/AIAssistant';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AIAssistant />
  },
  {
    path: '/ai-assistant',
    element: <AIAssistant />
  }
]);

export default router; 