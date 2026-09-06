import { Global, Module } from '@nestjs/common';
import { TemplateRegistry } from './template-registry.js';

@Global()
@Module({
  providers: [TemplateRegistry],
  exports: [TemplateRegistry],
})
export class TemplatesModule {}
