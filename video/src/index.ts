import { registerRoot } from 'remotion';
// 로컬 woff2 폰트 로딩을 시작한다(모듈 side effect). Root 보다 먼저 import 한다.
import './fonts';
import { RemotionRoot } from './Root';

registerRoot(RemotionRoot);
