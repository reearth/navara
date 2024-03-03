import './NavButton.css';

function NavButton({ label }: { label: string }){
  const e = new CustomEvent('locateposition', { detail: location[label] } )
  return (
    <button className="locate" onClick={() => document.dispatchEvent(e)}>{label}</button>
  )
}

const location: any = {
  'USA': { r: 589.0, x: 0.41076666, y: -0.42046106, z: -0.11033444, w: 0.8014467, tilt: 0.0 },
  'UK': { r: 589.0, x:-0.0075698216, y: -0.12992558, z: -0.35960066, w: 0.92398816, tilt: 0.0 },
};

export default NavButton;