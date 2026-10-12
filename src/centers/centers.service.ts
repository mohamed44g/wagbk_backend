import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { CreateCenterDto } from './dto/create-center.dto';

@Injectable()
export class CentersService {
  constructor(private readonly db: DatabaseService) {}

  async create(teacherId: string, dto: CreateCenterDto) {
    const result = await this.db.query(
      `INSERT INTO centers (teacher_id, name, address) VALUES ($1, $2, $3)
       RETURNING id, teacher_id, name, address, created_at`,
      [teacherId, dto.name, dto.address ?? null],
    );
    return result.rows[0];
  }

  async findAll(teacherId: string) {
    const result = await this.db.query(
      `SELECT c.id, c.name, c.address, c.created_at,
              COUNT(g.id)::int AS groups_count
       FROM centers c LEFT JOIN groups g ON g.center_id = c.id
       WHERE c.teacher_id = $1
       GROUP BY c.id ORDER BY c.created_at DESC`,
      [teacherId],
    );
    return result.rows;
  }

  async findOne(teacherId: string, centerId: string) {
    const result = await this.db.query(
      `SELECT id, teacher_id, name, address, created_at FROM centers WHERE id = $1 AND teacher_id = $2`,
      [centerId, teacherId],
    );
    if (!result.rowCount) throw new NotFoundException('Center not found');
    return result.rows[0];
  }
}
