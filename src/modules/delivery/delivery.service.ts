import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export class CreateAgentDto {
  name: string;
  phone: string;
}

export class AssignDeliveryDto {
  agentId: string;
  estimatedTime?: number; // minutes
}

export class UpdateDeliveryStatusDto {
  status: string;
  notes?: string;
}

@Injectable()
export class DeliveryService {
  constructor(private readonly dataSource: DataSource) {}

  // ─── Agents ───────────────────────────────────────────────────────────────────

  async getAgents(schemaName: string) {
    const s = `"${schemaName}"`;
    return this.dataSource.query(
      `SELECT * FROM ${s}.delivery_agents WHERE is_active = true ORDER BY name ASC`,
    );
  }

  async createAgent(schemaName: string, dto: CreateAgentDto) {
    const s = `"${schemaName}"`;
    const rows = await this.dataSource.query(
      `INSERT INTO ${s}.delivery_agents (name, phone) VALUES ($1, $2) RETURNING *`,
      [dto.name, dto.phone],
    );
    return rows[0];
  }

  async updateAgent(schemaName: string, agentId: string, dto: Partial<CreateAgentDto>) {
    const s = `"${schemaName}"`;
    const sets: string[] = [];
    const params: any[] = [];

    if (dto.name !== undefined) { params.push(dto.name); sets.push(`name = $${params.length}`); }
    if (dto.phone !== undefined) { params.push(dto.phone); sets.push(`phone = $${params.length}`); }

    if (!sets.length) throw new NotFoundException('No fields to update');

    params.push(agentId);
    const rows = await this.dataSource.query(
      `UPDATE ${s}.delivery_agents SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (!rows.length) throw new NotFoundException(`Agent ${agentId} not found`);
    return rows[0];
  }

  // ─── Deliveries ───────────────────────────────────────────────────────────────

  async getDeliveries(schemaName: string, page = 1, limit = 20, status?: string) {
    const s = `"${schemaName}"`;
    const offset = (page - 1) * limit;
    let whereClause = '';
    const params: any[] = [];

    if (status) {
      params.push(status);
      whereClause = `WHERE d.status = $${params.length}`;
    }

    params.push(limit, offset);

    const rows = await this.dataSource.query(
      `SELECT d.*, a.name as agent_name, a.phone as agent_phone
       FROM ${s}.deliveries d
       LEFT JOIN ${s}.delivery_agents a ON a.id = d.agent_id
       ${whereClause}
       ORDER BY d.assigned_at DESC NULLS LAST
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return rows;
  }

  async assignDelivery(schemaName: string, orderId: string, dto: AssignDeliveryDto) {
    const s = `"${schemaName}"`;

    // Check if a delivery record already exists for this order
    const existing = await this.dataSource.query(
      `SELECT id FROM ${s}.deliveries WHERE order_id = $1`,
      [orderId],
    );

    if (existing.length) {
      // Update existing record
      const rows = await this.dataSource.query(
        `UPDATE ${s}.deliveries
         SET agent_id = $1, status = 'ASSIGNED', estimated_time = $2, assigned_at = NOW()
         WHERE order_id = $3 RETURNING *`,
        [dto.agentId, dto.estimatedTime ?? null, orderId],
      );
      return rows[0];
    } else {
      // Create new delivery record
      const rows = await this.dataSource.query(
        `INSERT INTO ${s}.deliveries (order_id, agent_id, status, estimated_time, assigned_at)
         VALUES ($1, $2, 'ASSIGNED', $3, NOW()) RETURNING *`,
        [orderId, dto.agentId, dto.estimatedTime ?? null],
      );
      return rows[0];
    }
  }

  async updateDeliveryStatus(schemaName: string, deliveryId: string, dto: UpdateDeliveryStatusDto) {
    const s = `"${schemaName}"`;
    const deliveredAt = dto.status === 'DELIVERED' ? 'NOW()' : 'delivered_at';

    const rows = await this.dataSource.query(
      `UPDATE ${s}.deliveries
       SET status = $1, notes = COALESCE($2, notes), delivered_at = ${deliveredAt}
       WHERE id = $3 RETURNING *`,
      [dto.status, dto.notes ?? null, deliveryId],
    );
    if (!rows.length) throw new NotFoundException(`Delivery ${deliveryId} not found`);
    return rows[0];
  }
}
