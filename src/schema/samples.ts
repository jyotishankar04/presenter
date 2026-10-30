export const SAMPLES: { id: string; label: string; description: string; sql: string }[] = [
  { id: 'blog', label: 'Blog', description: 'Users, posts, comments, tags', sql: `
CREATE TABLE users (
  id uuid PRIMARY KEY,
  email varchar(255) NOT NULL UNIQUE,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE posts (
  id bigserial PRIMARY KEY,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  published_at timestamptz
);
CREATE TABLE comments (
  id bigserial PRIMARY KEY,
  post_id bigint NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tags (id serial PRIMARY KEY, name varchar(50) NOT NULL UNIQUE);
CREATE TABLE post_tags (
  post_id bigint NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id int NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);` },
  { id: 'shop', label: 'E-commerce', description: 'Customers, orders, products, payments', sql: `
CREATE TABLE customers (id uuid PRIMARY KEY, email varchar(255) NOT NULL UNIQUE, name text NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE addresses (id uuid PRIMARY KEY, customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE, line1 text NOT NULL, city text NOT NULL, country char(2) NOT NULL);
CREATE TABLE products (id uuid PRIMARY KEY, sku varchar(40) NOT NULL UNIQUE, name text NOT NULL, price_cents int NOT NULL, stock int NOT NULL DEFAULT 0);
CREATE TABLE orders (id uuid PRIMARY KEY, customer_id uuid NOT NULL REFERENCES customers(id), shipping_address_id uuid REFERENCES addresses(id), status varchar(20) NOT NULL DEFAULT 'pending', placed_at timestamptz DEFAULT now());
CREATE TABLE order_items (order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE, product_id uuid NOT NULL REFERENCES products(id), quantity int NOT NULL DEFAULT 1, unit_price_cents int NOT NULL, PRIMARY KEY (order_id, product_id));
CREATE TABLE payments (id uuid PRIMARY KEY, order_id uuid NOT NULL UNIQUE REFERENCES orders(id), provider varchar(30) NOT NULL, amount_cents int NOT NULL, paid_at timestamptz);` },
  { id: 'urls', label: 'URL shortener', description: 'Links, clicks, users', sql: `
CREATE TABLE users (id uuid PRIMARY KEY, email varchar(255) NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE links (id bigserial PRIMARY KEY, code varchar(10) NOT NULL UNIQUE, long_url text NOT NULL, owner_id uuid REFERENCES users(id) ON DELETE SET NULL, expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE clicks (id bigserial PRIMARY KEY, link_id bigint NOT NULL REFERENCES links(id) ON DELETE CASCADE, clicked_at timestamptz NOT NULL DEFAULT now(), country char(2), user_agent text);` },
]
