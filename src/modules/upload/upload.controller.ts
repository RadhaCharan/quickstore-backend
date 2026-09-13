import {
  Controller, Post, UseGuards, UseInterceptors, UploadedFile, BadRequestException, Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { v4 as uuid } from 'uuid';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';

// Local-disk storage for the POC — swap for the already-installed @aws-sdk/client-s3
// here (same controller shape) if/when this needs to run across multiple app instances.
export const UPLOAD_ROOT = join(process.cwd(), 'uploads');
const ALLOWED_MIME = /^image\/(jpeg|png|webp|gif)$/;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB

@ApiTags('Uploads')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('uploads')
export class UploadController {
  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '[VENDOR] Upload an image (product photo, category icon, store logo/banner) — returns its public URL' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req: any, _file, cb) => {
          const schema = req.tenantSchemaName || 'shared';
          const dir = join(UPLOAD_ROOT, schema);
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => cb(null, `${uuid()}${extname(file.originalname).toLowerCase()}`),
      }),
      limits: { fileSize: MAX_FILE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.test(file.mimetype)) {
          cb(new BadRequestException('Only JPG, PNG, WEBP or GIF images are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentTenant('schema') schemaName: string,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('No file uploaded — attach it as "file" in a multipart/form-data body');
    const base = `${req.protocol}://${req.get('host')}`;
    return { url: `${base}/uploads/${schemaName}/${file.filename}`, size: file.size, mimeType: file.mimetype };
  }
}
