import { Module } from '@nestjs/common';
import { ContactService } from './contact.service.js';
import { ContactProjectionConsumer } from './contact-projection.consumer.js';

@Module({
  providers: [ContactService, ContactProjectionConsumer],
  exports: [ContactService, ContactProjectionConsumer],
})
export class ContactsModule {}
