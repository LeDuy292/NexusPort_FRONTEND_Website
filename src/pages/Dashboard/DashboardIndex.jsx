import React from 'react'
import { ROLES } from '../../routes/routeConfig'
import OperatorDashboard from './OperatorDashboard'
import DispatcherDashboard from './DispatcherDashboard'
import YardDashboard from './YardDashboard'

export default function DashboardIndex() {
  const user = JSON.parse(localStorage.getItem('user')) || {}

  if (user.role === ROLES.DISPATCHER) {
    return <DispatcherDashboard />
  }

  if (user.role === ROLES.YARD_OPERATOR) {
    return <YardDashboard />
  }

  // Mặc định vai trò Administrator hoặc vai trò quản trị chung
  return <OperatorDashboard />
}
