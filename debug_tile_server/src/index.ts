import { serve } from '@hono/node-server'
import { createCanvas } from 'canvas';
import { Hono } from 'hono'
import { cors } from 'hono/cors';

const app = new Hono();

app.use('*', cors());

app.get('/:z/:x/:y', async (c) => {
  const { x, y: _y, z } = c.req.param();
  const y = _y.slice(0, _y.indexOf("."));

  const size = 256;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = '#FFFFFF';
  const border = 5;
  ctx.fillRect(border, border, size - border, size - border);

  ctx.fillStyle = '#000000';
  ctx.font = '20px Arial';
  ctx.fillText(`z: ${z}`, 10, 30);
  ctx.fillText(`x: ${x}`, 10, 60);
  ctx.fillText(`y: ${y}`, 10, 90);


  return new Promise<Buffer>(r => canvas.toBuffer((err, buf) => {
      if (err) throw err;
      r(buf);
  })).then((buf) => {
    c.header('Content-Type', 'image/png');
    return c.body(buf);
  });
})

const port = 8888;
console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port
})
