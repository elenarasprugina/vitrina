import cv2, numpy as np, sys, subprocess
src,dst=sys.argv[1],sys.argv[2]
L=int(sys.argv[3]); C=int(sys.argv[4])
cap=cv2.VideoCapture(src); F=[]
while len(F)<L:
    ok,f=cap.read()
    if not ok: break
    F.append(f)
L=len(F); h,w=F[0].shape[:2]; y0=int(h*0.55)
G=[cv2.cvtColor(f,cv2.COLOR_BGR2GRAY)[y0:h-20,20:w-20].astype(np.float32) for f in F]
crit=(cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,200,1e-5)
P=[]; prev=np.eye(2,3,dtype=np.float32)
for i,g in enumerate(G):
    m=prev.copy()
    try: _,m=cv2.findTransformECC(G[0],g,m,cv2.MOTION_EUCLIDEAN,crit,None,5)
    except cv2.error: m=prev.copy()
    prev=m; P.append([m[0,2],m[1,2],np.arctan2(m[1,0],m[0,0])])
P=np.array(P)
# light smoothing so measurement noise doesn't add jitter
k=5; ker=np.ones(2*k+1)/(2*k+1)
Ps=np.stack([np.convolve(np.pad(P[:,j],k,mode='edge'),ker,'valid') for j in range(3)],1)
Ps[:,0]-=(Ps[:,0].max()+Ps[:,0].min())/2; Ps[:,1]-=(Ps[:,1].max()+Ps[:,1].min())/2
mx=abs(Ps[:,0]).max(); my=abs(Ps[:,1]).max()
z=max(1+2*(mx+4)/w, 1+2*(my+4)/h)
print("shift ±%.1f ±%.1f -> zoom %.3f"%(mx,my,z))
cx,cy=w/2,h/2
out=[]
for f,(dx,dy,a) in zip(F,Ps):
    # inverse of measured motion, then zoom about centre
    R=cv2.getRotationMatrix2D((cx,cy),np.degrees(a),z)
    R[0,2]-=dx*z; R[1,2]-=dy*z
    out.append(cv2.warpAffine(f,R,(w,h),flags=cv2.INTER_LANCZOS4,borderMode=cv2.BORDER_REFLECT))
seq=out[C:L-C]
for j in range(C):
    t=(j+0.5)/C; t=t*t*(3-2*t)
    seq.append(cv2.addWeighted(out[L-C+j],1-t,out[j],t,0))
p=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s','%dx%d'%(w,h),'-r','24','-i','-',
  '-c:v','libx264','-preset','slow','-crf','27','-pix_fmt','yuv420p','-movflags','+faststart','-an',dst],stdin=subprocess.PIPE)
for f in seq: p.stdin.write(f.tobytes())
p.stdin.close(); p.wait(); print("frames",len(seq))
