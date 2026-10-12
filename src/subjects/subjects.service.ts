import { ConflictException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { CreateSubjectDto } from './dto/create-subject.dto';

@Injectable()
export class SubjectsService {
  constructor(private readonly db: DatabaseService) {}

  async findAll() {
    const result = await this.db.query(
      `SELECT id, name_ar AS "nameAr", name_en AS "nameEn", slug
       FROM subjects WHERE is_active = true ORDER BY name_ar`,
    );
    return result.rows;
  }

  async create(dto: CreateSubjectDto) {
    try {
      const result = await this.db.query(
        `INSERT INTO subjects (name_ar, name_en, slug)
         VALUES ($1, $2, $3)
         RETURNING id, name_ar AS "nameAr", name_en AS "nameEn", slug, is_active`,
        [dto.nameAr, dto.nameEn, dto.slug.toLowerCase()],
      );
      return result.rows[0];
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('Subject slug already exists');
      }
      throw error;
    }
  }
}
