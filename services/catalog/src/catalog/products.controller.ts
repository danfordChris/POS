import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { InternalContextGuard } from '@pos/nest-common';
import { TenantGuard } from '../tenant/tenant.guard.js';
import {
  RolesGuard,
  Roles,
  type MembershipRole,
} from '../tenant/roles.decorator.js';
import { CurrentMembership } from '../tenant/current-membership.decorator.js';
import type { CurrentMembershipValue } from '../tenant/current-membership.decorator.js';
import { CatalogService } from './catalog.service.js';
import { MediaService } from '../media/media.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ListProductsQuery } from './dto/list-products.query.js';

interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

@ApiTags('catalog')
@Controller('businesses/:businessId/products')
@UseGuards(InternalContextGuard, TenantGuard, RolesGuard)
export class ProductsController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly media: MediaService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  list(
    @Param('businessId') businessId: string,
    @Query() query: ListProductsQuery,
    @CurrentMembership() membership: CurrentMembershipValue,
  ) {
    return this.catalog.listProducts(
      businessId,
      membership.role as MembershipRole,
      query,
    );
  }

  @Get(':id')
  get(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @CurrentMembership() membership: CurrentMembershipValue,
  ) {
    return this.catalog.getProduct(
      businessId,
      membership.role as MembershipRole,
      id,
    );
  }

  @Post()
  @Roles('owner', 'staff')
  create(
    @Param('businessId') businessId: string,
    @Body() dto: CreateProductDto,
    @CurrentMembership() membership: CurrentMembershipValue,
  ) {
    return this.catalog.createProduct(
      businessId,
      membership.role as MembershipRole,
      dto,
    );
  }

  @Patch(':id')
  @Roles('owner', 'staff')
  update(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentMembership() membership: CurrentMembershipValue,
  ) {
    return this.catalog.updateProduct(
      businessId,
      membership.role as MembershipRole,
      id,
      dto,
    );
  }

  @Post(':id/deactivate')
  @Roles('owner', 'staff')
  deactivate(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @CurrentMembership() membership: CurrentMembershipValue,
  ) {
    return this.catalog.deactivateProduct(
      businessId,
      membership.role as MembershipRole,
      id,
    );
  }

  @Post(':id/image')
  @Roles('owner', 'staff')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  async uploadImage(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @UploadedFile() file: UploadedImage | undefined,
    @CurrentMembership() membership: CurrentMembershipValue,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: 'validation_error',
        message: 'Attach an image file in the `image` field',
        details: [{ field: 'image', issue: 'required' }],
      });
    }
    const maxBytes = this.config.get<number>('IMAGE_MAX_BYTES') ?? 5_000_000;
    if (file.size > maxBytes) {
      throw new BadRequestException({
        code: 'validation_error',
        message: 'Image is too large',
        devMessage: `image ${file.size} bytes exceeds IMAGE_MAX_BYTES=${maxBytes}`,
        details: [{ field: 'image', issue: 'too_large' }],
      });
    }
    if (!MediaService.isSupportedMime(file.mimetype)) {
      throw new BadRequestException({
        code: 'validation_error',
        message: 'Image must be a JPEG, PNG, or WebP',
        details: [
          { field: 'image', issue: `unsupported type ${file.mimetype}` },
        ],
      });
    }

    // Make sure the product exists (and is in this tenant) before we store bytes.
    await this.catalog.getProduct(
      businessId,
      membership.role as MembershipRole,
      id,
    );
    const { url } = await this.media.uploadProductImage(
      businessId,
      id,
      file.buffer,
      file.mimetype,
    );
    return this.catalog.setProductImage(
      businessId,
      membership.role as MembershipRole,
      id,
      url,
    );
  }
}
