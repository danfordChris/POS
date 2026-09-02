'use client';

import { useActionState } from 'react';
import { Button, Card, ErrorCard } from '@/components/ui';
import {
  deactivateProduct,
  uploadProductImage,
  type FormState,
} from '@/app/(shell)/catalog/actions';
import type { Product } from '@/lib/models';

export function ProductActions({ product }: { product: Product }) {
  const deactivate = deactivateProduct.bind(null, product.id);
  const upload = uploadProductImage.bind(null, product.id);

  const [deState, deAction, dePending] = useActionState<FormState, FormData>(deactivate, {});
  const [imgState, imgAction, imgPending] = useActionState<FormState, FormData>(upload, {});

  return (
    <Card className="flex flex-col gap-5">
      <div>
        <h2 className="text-h3 font-semibold">Image</h2>
        <p className="text-caption text-text-secondary">JPEG, PNG or WebP.</p>
      </div>
      {product.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.image_url}
          alt={product.name}
          className="h-32 w-32 rounded-card object-cover shadow-elev-sm"
        />
      ) : null}
      <form action={imgAction} className="flex items-center gap-3">
        <input
          type="file"
          name="image"
          accept="image/jpeg,image/png,image/webp"
          className="text-caption text-text-secondary"
        />
        <Button type="submit" variant="secondary" size="sm" disabled={imgPending}>
          {imgPending ? 'Uploading…' : 'Upload'}
        </Button>
      </form>
      {imgState.error ? (
        <ErrorCard code={imgState.error.code} title={imgState.error.message} />
      ) : null}

      {product.is_active ? (
        <form
          action={deAction}
          onSubmit={(e) => {
            if (!confirm('Deactivate this product? It stays in reports and history.'))
              e.preventDefault();
          }}
        >
          <Button type="submit" variant="destructive" size="sm" disabled={dePending}>
            {dePending ? 'Working…' : 'Deactivate product'}
          </Button>
        </form>
      ) : (
        <p className="text-caption text-warning">This product is inactive.</p>
      )}
      {deState.error ? <ErrorCard code={deState.error.code} title={deState.error.message} /> : null}
    </Card>
  );
}
