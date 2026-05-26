const { exec } = require('child_process');
const { resolve } = require('path');

const projectRoot = resolve(__dirname, '..');

// 启动 Vite 开发服务器
const viteProcess = exec('npm run dev', { cwd: projectRoot }, (error) => {
  if (error) {
    console.error(`执行 npm run dev 时出错: ${error}`);
  }
});

viteProcess.stdout.on('data', (data) => {
  console.log(data);
  if (data.includes('ready')) {
    setTimeout(() => {
      console.log('starting NW.js...');
      const nwProcess = exec('npx nw . --url=http://localhost:9801', { cwd: projectRoot }, (error) => {
        if (error) {
          console.error(`启动 NW.js 时出错: ${error}`);
        }
      });

      nwProcess.stdout.on('data', (data) => console.log(data));
      nwProcess.stderr.on('data', (data) => console.error(data));
      nwProcess.on('close', (code) => {
        console.log(`NW.js 退出: ${code}`);
        viteProcess.kill();
      });

      process.on('SIGINT', () => { nwProcess.kill(); viteProcess.kill(); process.exit(); });
      process.on('SIGTERM', () => { nwProcess.kill(); viteProcess.kill(); process.exit(); });
    }, 2000);
  }
});

viteProcess.stderr.on('data', (data) => console.error(data));
viteProcess.on('close', (code) => console.log(`Vite 退出: ${code}`));
