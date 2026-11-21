export interface WebGLSupportInfo {
  supported: boolean;
  isSoftwareGl: boolean;
}

export function checkWebGLSupport(): WebGLSupportInfo {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      (canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) as WebGL2RenderingContext | null) ||
      (canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false }) as WebGLRenderingContext | null);

    if (!gl) {
      return { supported: false, isSoftwareGl: false };
    }

    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render|Disabled/i.test(gpu);

    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { supported: true, isSoftwareGl };
  } catch {
    return { supported: false, isSoftwareGl: false };
  }
}
